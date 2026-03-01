# Missing Frontend Requirements & Use Cases (Doorman vs. Samrum)

This document outlines the functional gaps and provides detailed implementation steps for AI agents to follow.

1. docs/sarum.pdf is the frontend requirement from previous app for the /admin ui.
usecasename --> page in pdf --> description in pdf --> status --> url --> comment
usecase1 --> page 13 --> User Interface - samrum - Inlogging --> Done --> http://localhost:3001/login --> use admin/password123
usecase2 --> page 14 --> User Interface - Val av project --> Done --> http://localhost:3001/select-project --> first screen
usecase3 --> page 15 --> User Interface - Använderlage --> Done  --> http://localhost:3001/admin/users --> all below is per project
usecase3.1 --> page 15 --> User Interface - Använderlage --> Done  --> http://localhost:3001/project/1 --> 
usecase4 --> page 16 --> User Interface - Använderlage Modul--> Done --> http://localhost:3001/modules/269 --> wsame as in http://localhost:3001/admin/modules/269
usecase5 --> page 17 --> User Interface - Använderlage Modul--> Done --> http://localhost:3001/admin/modules/269 --> Column selection and filter are working but all columns possible should be visible, like from the original door object and expandable related object and like recursive
usecase6 --> page 18 --> User Interface - Användarläge (Objekt) --> Done --> http://localhost:3001/objects/12?module=269 --> Module-aware read view with Swedish labels from module_view_columns, EJ ANGIVET in red, related object sub-sections, left Projektvy sidebar; edit view with typed field inputs (boolean=select, enum=select, date, number, text), relationship add/remove picker, UPSERT save via attribute_id
usecase7 --> page 19 --> User Interface - A001 Lägg till/ändra objekt --> Done --> http://localhost:3001/objects/new?module=269 --> Create new object instance form (Lägg till) with all module fields, external_id + name inputs, Aktivt toggle, Återkall (revert) in edit toolbar, Koppla bort for relationship removal; Skapa ny button from list/detail navigates here
usecase8 --> page 20 --> User Interface - A001 Ändra objekt (gruppvis ändring) --> Done --> http://localhost:3001/objects/bulk-edit?module=269&ids=12,13 --> Full-page group/bulk edit: per-field checkboxes to select which attributes to update, typed inputs (boolean=select, enum=select, date, number, text), Aktivt toggle, Projektvy sidebar showing X objects selected + checked field previews; Gruppvis ändring toolbar button in module list navigates here with selected IDs