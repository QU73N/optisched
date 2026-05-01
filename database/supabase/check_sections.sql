-- Check sections data including path field
SELECT 
    id, 
    name, 
    program, 
    year_level, 
    student_count, 
    parent_id, 
    weight, 
    path, 
    node_type, 
    is_active, 
    description, 
    metadata, 
    sort_order, 
    load_category, 
    special_scheduling_rules
FROM sections
LIMIT 10;
