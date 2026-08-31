#!/bin/bash

for module in module-*; do
    mod_num=$(echo $module | sed 's/module-//')
    echo "=== MODULE $mod_num ==="
    
    for lesson_file in $module/lesson-*.html; do
        lesson_num=$(basename "$lesson_file" .html | sed 's/lesson-//')
        
        canvas=$(grep -c '<canvas' "$lesson_file" 2>/dev/null || echo 0)
        schematic=$(grep -c 'AD\.Schematic' "$lesson_file" 2>/dev/null || echo 0)
        svg=$(grep -c '<svg' "$lesson_file" 2>/dev/null || echo 0)
        spice=$(grep -c 'SPICE\|\.cir\|netlist' "$lesson_file" 2>/dev/null || echo 0)
        
        total=$((canvas + schematic + svg))
        
        echo "$lesson_num,$canvas,$schematic,$svg,$total,$spice"
    done
done
