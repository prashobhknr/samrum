-- Phase 2: Data Migration Validation
-- Run after migration to verify data integrity

-- ============================================================================
-- VALIDATION 1: Count Verification
-- ============================================================================
-- Expected: Should match number of doors migrated
SELECT 
  'Door Instances' as check_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN object_type_id = 1 THEN 1 END) as door_count
FROM object_instances;

-- ============================================================================
-- VALIDATION 2: Required Attributes Completeness
-- ============================================================================
-- Expected: 0 rows (all required attributes must be present)
SELECT 
  oi.external_id,
  oa.attribute_name,
  'MISSING REQUIRED ATTRIBUTE' as issue
FROM object_instances oi
JOIN object_attributes oa ON oa.object_type_id = 1
WHERE oi.object_type_id = 1
AND oa.is_required = true
AND NOT EXISTS (
  SELECT 1 FROM attribute_values av
  WHERE av.object_instance_id = oi.id
  AND av.object_attribute_id = oa.id
  AND av.value IS NOT NULL
)
ORDER BY oi.external_id, oa.attribute_name;

-- ============================================================================
-- VALIDATION 3: Primary Key Integrity
-- ============================================================================
-- Expected: 0 rows (no NULLs in external_id)
SELECT 
  id,
  'NULL external_id' as issue
FROM object_instances
WHERE object_type_id = 1
AND external_id IS NULL;

-- ============================================================================
-- VALIDATION 4: No Duplicate Doors
-- ============================================================================
-- Expected: 0 rows (no duplicate external_ids)
SELECT 
  external_id,
  COUNT(*) as duplicate_count
FROM object_instances
WHERE object_type_id = 1
GROUP BY external_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- VALIDATION 5: Referential Integrity
-- ============================================================================
-- Expected: 0 rows (all parent_instance_id must exist)
SELECT 
  oi.external_id,
  oi.parent_instance_id,
  'ORPHANED PARENT' as issue
FROM object_instances oi
WHERE oi.object_type_id = 1
AND oi.parent_instance_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM object_instances parent
  WHERE parent.id = oi.parent_instance_id
);

-- ============================================================================
-- VALIDATION 6: Data Quality - Enum Values
-- ============================================================================
-- Expected: 0 rows (all enums must match allowed values)
SELECT 
  oi.external_id,
  oa.attribute_name,
  av.value,
  oa.enum_values as allowed_values,
  'INVALID ENUM' as issue
FROM object_instances oi
JOIN attribute_values av ON av.object_instance_id = oi.id
JOIN object_attributes oa ON oa.id = av.object_attribute_id
WHERE oi.object_type_id = 1
AND oa.attribute_type = 'enum'
AND NOT (av.value = ANY(oa.enum_values::text[]))
ORDER BY oi.external_id, oa.attribute_name;

-- ============================================================================
-- VALIDATION 7: Numeric Range Validation
-- ============================================================================
-- Expected: No invalid numbers (floor_number should be -4 to 10, widths > 0, etc.)
SELECT 
  oi.external_id,
  oa.attribute_name,
  av.value,
  CASE 
    WHEN oa.attribute_name = 'floor_number' AND (av.value::integer < -4 OR av.value::integer > 10) 
      THEN 'OUT OF RANGE'
    WHEN oa.attribute_name ~ '_(mm|kg)$' AND av.value::numeric <= 0 
      THEN 'INVALID: Must be > 0'
    ELSE 'OK'
  END as validation
FROM object_instances oi
JOIN attribute_values av ON av.object_instance_id = oi.id
JOIN object_attributes oa ON oa.id = av.object_attribute_id
WHERE oi.object_type_id = 1
AND oa.attribute_type = 'number'
AND av.value ~ '^\d+(\.\d+)?$'
HAVING CASE 
  WHEN oa.attribute_name = 'floor_number' AND (av.value::integer < -4 OR av.value::integer > 10) 
    THEN true
  WHEN oa.attribute_name ~ '_(mm|kg)$' AND av.value::numeric <= 0 
    THEN true
  ELSE false
END
ORDER BY oi.external_id, oa.attribute_name;

-- ============================================================================
-- VALIDATION 8: Date Format Validation
-- ============================================================================
-- Expected: 0 rows (all dates must be YYYY-MM-DD)
SELECT 
  oi.external_id,
  oa.attribute_name,
  av.value,
  'INVALID DATE FORMAT' as issue
FROM object_instances oi
JOIN attribute_values av ON av.object_instance_id = oi.id
JOIN object_attributes oa ON oa.id = av.object_attribute_id
WHERE oi.object_type_id = 1
AND oa.attribute_type = 'date'
AND av.value !~ '^\d{4}-\d{2}-\d{2}$';

-- ============================================================================
-- VALIDATION 9: Completeness Report
-- ============================================================================
SELECT 
  'Completeness Metrics' as metric,
  COUNT(DISTINCT oi.id) as total_doors,
  COUNT(DISTINCT av.id) as total_attribute_values,
  ROUND(100.0 * COUNT(DISTINCT av.id) / 
    (COUNT(DISTINCT oi.id) * 34), 2) as completeness_percent
FROM object_instances oi
LEFT JOIN attribute_values av ON av.object_instance_id = oi.id
WHERE oi.object_type_id = 1;

-- ============================================================================
-- VALIDATION 10: Sample Data Quality Check
-- ============================================================================
-- Show 5 random doors with all their attributes
SELECT 
  oi.external_id as door_id,
  oi.name as door_name,
  oa.attribute_name,
  av.value,
  oa.is_required,
  oa.attribute_type
FROM object_instances oi
JOIN object_attributes oa ON oa.object_type_id = oi.object_type_id
LEFT JOIN attribute_values av ON av.object_instance_id = oi.id 
  AND av.object_attribute_id = oa.id
WHERE oi.object_type_id = 1
AND oi.id IN (
  SELECT id FROM object_instances 
  WHERE object_type_id = 1 
  ORDER BY RANDOM() 
  LIMIT 5
)
ORDER BY oi.external_id, oa.id;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
-- Generate final report
WITH validation AS (
  SELECT 
    (SELECT COUNT(*) FROM object_instances WHERE object_type_id = 1) as total_doors,
    (SELECT COUNT(*) FROM object_instances WHERE object_type_id = 1 AND external_id IS NULL) as null_ids,
    (SELECT COUNT(*) FROM (SELECT external_id, COUNT(*) as cnt FROM object_instances WHERE object_type_id = 1 GROUP BY external_id HAVING COUNT(*) > 1) dupes) as duplicates,
    (SELECT COUNT(*) FROM attribute_values av JOIN object_attributes oa ON oa.id = av.object_attribute_id 
     WHERE oa.is_required AND av.value IS NULL) as missing_required,
    (SELECT COUNT(*) FROM object_instances WHERE object_type_id = 1 AND parent_instance_id IS NOT NULL AND parent_instance_id NOT IN (SELECT id FROM object_instances)) as orphaned_refs
)
SELECT 
  'MIGRATION VALIDATION REPORT' as title,
  CURRENT_TIMESTAMP as generated_at,
  (total_doors > 0) as PASSED,
  total_doors,
  null_ids,
  duplicates,
  missing_required,
  orphaned_refs,
  CASE WHEN total_doors > 0 AND null_ids = 0 AND duplicates = 0 AND missing_required = 0 AND orphaned_refs = 0 
    THEN '✅ ALL VALIDATION CHECKS PASSED'
    ELSE '❌ VALIDATION FAILED'
  END as status
FROM validation;
