/* eslint-disable no-console */
/**
 * Scan all lesson files for potential schematic validation issues.
 *
 * This script looks for patterns that commonly cause "SCHEMATIC ERROR" messages:
 * 1. nodeLabel not connected to wire
 * 2. Wire gaps (wire doesn't reach component terminal)
 * 3. Ground symbols not connected
 */

const fs = require('fs');
const path = require('path');

const lessonsDir = path.join(process.cwd(), 'lessons');

function findLessonFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findLessonFiles(fullPath));
        } else if (entry.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

function analyzeSchematic(content, filePath) {
    const issues = [];
    const relativePath = filePath.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');

    // Check if file has schematics
    if (!content.includes('AD.Schematic') && !content.includes('Schematic.create')) {
        return null;
    }

    // Extract script sections
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/g);
    if (!scriptMatch) return null;

    const script = scriptMatch.join('\n');

    // Pattern 1: nodeLabel followed by wire that doesn't start at same position
    const nodeLabelPattern = /sch\.nodeLabel\(\s*([^,]+),\s*([^,]+),/g;
    let match;
    while ((match = nodeLabelPattern.exec(script)) !== null) {
        const labelX = match[1].trim();
        const labelY = match[2].trim();

        // Look for nearby wire declarations
        const context = script.slice(Math.max(0, match.index - 500), match.index + 500);

        // Check if there's a wire that connects TO this label position
        // Common issue: wire ends at different position than label
        if (!context.includes(`[[${labelX}, ${labelY}]`) &&
            !context.includes(`[${labelX}, ${labelY}]]`) &&
            !context.includes(`, ${labelX}, ${labelY}]`)) {
            // This is a potential issue - label might not be connected
            const lineNum = script.slice(0, match.index).split('\n').length;
            issues.push({
                type: 'potential_floating_label',
                line: lineNum,
                detail: `nodeLabel at (${labelX}, ${labelY}) - verify wire connection`
            });
        }
    }

    // Pattern 2: Check for ground symbols
    const groundPattern = /sch\.ground\(\s*([^,]+),\s*([^)]+)\)/g;
    while ((match = groundPattern.exec(script)) !== null) {
        const gndX = match[1].trim();
        const gndY = match[2].trim();

        // Look for wire that ends at ground position
        const context = script.slice(Math.max(0, match.index - 500), match.index);
        if (!context.includes(`${gndX}, ${gndY}]]`) && !context.includes(`${gndX}, ${gndY}]`)) {
            const lineNum = script.slice(0, match.index).split('\n').length;
            issues.push({
                type: 'potential_floating_ground',
                line: lineNum,
                detail: `ground at (${gndX}, ${gndY}) - verify wire reaches it`
            });
        }
    }

    // Pattern 3: Look for hardcoded coordinate mismatches
    // e.g., wire ends at x+35 but label at x+45
    const wireToLabelGaps = /sch\.wire\(\[\[.*?,\s*([^+\]]+)\s*\+\s*(\d+)[^\]]*\]\]\);\s*\n\s*sch\.nodeLabel\(\s*\1\s*\+\s*(\d+)/g;
    while ((match = wireToLabelGaps.exec(script)) !== null) {
        const wireOffset = parseInt(match[2]);
        const labelOffset = parseInt(match[3]);
        if (wireOffset !== labelOffset) {
            const lineNum = script.slice(0, match.index).split('\n').length;
            issues.push({
                type: 'coordinate_mismatch',
                line: lineNum,
                detail: `Wire ends at +${wireOffset} but label at +${labelOffset} (${labelOffset - wireOffset}px gap)`
            });
        }
    }

    return issues.length > 0 ? { file: relativePath, issues } : null;
}

function main() {
    console.log('Scanning lesson files for potential schematic issues...\n');

    const files = findLessonFiles(lessonsDir);
    const allIssues = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const result = analyzeSchematic(content, file);
        if (result) {
            allIssues.push(result);
        }
    }

    if (allIssues.length === 0) {
        console.log('No potential issues found.');
        return;
    }

    console.log(`Found potential issues in ${allIssues.length} files:\n`);

    for (const { file, issues } of allIssues) {
        console.log(`--- ${file} ---`);
        for (const issue of issues) {
            console.log(`  Line ~${issue.line}: [${issue.type}] ${issue.detail}`);
        }
        console.log();
    }

    console.log('Note: These are heuristic checks. Manual verification is recommended.');
    console.log('Use browser DevTools to see actual SCHEMATIC ERROR messages.');
}

main();
