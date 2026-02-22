/**
 * Phase 4: Dynamic Form Component
 * 
 * Renders permission-filtered forms based on FormSchema
 * - Text, number, date, enum, boolean fields
 * - Permission-based visibility and editability
 * - Type validation
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormSchema, FormField } from '@/lib/api';

interface DynamicFormProps {
  schema: FormSchema;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isSubmitting?: boolean;
}

export default function DynamicForm({ schema, onSubmit, isSubmitting }: DynamicFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [submitError, setSubmitError] = useState('');

  const onSubmitForm = async (data: Record<string, any>) => {
    setSubmitError('');
    try {
      await onSubmit(data);
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  };

  const visibleFields = schema.fields.filter((field) => field.visible);

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{schema.form_header}</h2>
        <p className="text-sm text-gray-500 mt-2">Task: {schema.task_id}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {submitError}
          </div>
        )}

        {visibleFields.map((field) => (
          <FormFieldRenderer
            key={field.attribute_id}
            field={field}
            register={register}
            errors={errors}
          />
        ))}

        {/* Submit Button */}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isSubmitting || schema.metadata.read_only}
            className="flex-1 bg-primary hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            {isSubmitting ? 'Submitting...' : schema.metadata.read_only ? 'Read Only' : 'Submit'}
          </button>
        </div>
      </form>

      {/* Metadata */}
      <div className="mt-8 pt-6 border-t text-xs text-gray-500">
        <p>Generated: {new Date(schema.metadata.generated_at).toLocaleString()}</p>
        <p>User Group: {schema.metadata.user_group}</p>
      </div>
    </div>
  );
}

interface FormFieldRendererProps {
  field: FormField;
  register: any;
  errors: any;
}

function FormFieldRenderer({ field, register, errors }: FormFieldRendererProps) {
  const errorMessage = errors[field.attribute_name]?.message;

  return (
    <div>
      <label htmlFor={field.attribute_name} className="block text-sm font-medium text-gray-700">
        {field.attribute_name.replace(/_/g, ' ')}
        {field.required && <span className="text-red-500">*</span>}
      </label>

      {field.help_text && (
        <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
      )}

      {field.type === 'text' && (
        <input
          type="text"
          id={field.attribute_name}
          defaultValue={field.value || ''}
          disabled={!field.editable}
          placeholder={field.placeholder || ''}
          {...register(field.attribute_name, {
            required: field.required ? `${field.attribute_name} is required` : false,
          })}
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          id={field.attribute_name}
          defaultValue={field.value || ''}
          disabled={!field.editable}
          {...register(field.attribute_name, {
            required: field.required ? `${field.attribute_name} is required` : false,
            validate: (value: string) =>
              !value || !isNaN(parseFloat(value)) || `${field.attribute_name} must be a number`,
          })}
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      )}

      {field.type === 'date' && (
        <input
          type="date"
          id={field.attribute_name}
          defaultValue={field.value || ''}
          disabled={!field.editable}
          {...register(field.attribute_name, {
            required: field.required ? `${field.attribute_name} is required` : false,
          })}
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      )}

      {field.type === 'enum' && field.enum_values && (
        <select
          id={field.attribute_name}
          defaultValue={field.value || ''}
          disabled={!field.editable}
          {...register(field.attribute_name, {
            required: field.required ? `${field.attribute_name} is required` : false,
          })}
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select an option...</option>
          {field.enum_values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {field.type === 'boolean' && (
        <input
          type="checkbox"
          id={field.attribute_name}
          defaultChecked={field.value === 'true'}
          disabled={!field.editable}
          {...register(field.attribute_name)}
          className="mt-2 h-4 w-4 border border-gray-300 rounded focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
        />
      )}

      {errorMessage && (
        <p className="text-sm text-red-600 mt-1">{String(errorMessage)}</p>
      )}

      {!field.editable && (
        <p className="text-xs text-gray-500 mt-1">Read-only field</p>
      )}
    </div>
  );
}
