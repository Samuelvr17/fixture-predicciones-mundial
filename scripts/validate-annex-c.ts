/**
 * Validation script for Annex C 2026 data
 * 
 * This script validates the official FIFA World Cup 2026 Annex C data
 * which contains 495 possible combinations of third-place team assignments.
 */

import annexCData from '../src/data/annex-c-2026.json';

interface AnnexCEntry {
  option: number;
  '1A': string;
  '1B': string;
  '1D': string;
  '1E': string;
  '1G': string;
  '1I': string;
  '1K': string;
  '1L': string;
}

type AnnexCData = Record<string, AnnexCEntry>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateEntryCount(data: AnnexCData): boolean {
  const count = Object.keys(data).length;
  if (count !== 495) {
    console.error(`❌ Expected 495 entries, found ${count}`);
    return false;
  }
  console.log('✅ Exactly 495 entries');
  return true;
}

function validateOptionNumbers(data: AnnexCData): boolean {
  const options = Object.values(data).map(entry => entry.option);
  const uniqueOptions = new Set(options);
  
  if (uniqueOptions.size !== 495) {
    console.error(`❌ Found duplicate options. Expected 495 unique options, found ${uniqueOptions.size}`);
    return false;
  }
  
  const sortedOptions = Array.from(uniqueOptions).sort((a, b) => a - b);
  for (let i = 0; i < sortedOptions.length; i++) {
    if (sortedOptions[i] !== i + 1) {
      console.error(`❌ Missing or duplicate option number. Expected ${i + 1}, found ${sortedOptions[i]}`);
      return false;
    }
  }
  
  console.log('✅ Options 1-495 without gaps or duplicates');
  return true;
}

function validateKeys(data: AnnexCData): boolean {
  let valid = true;
  
  for (const [key, entry] of Object.entries(data)) {
    // Check key length
    if (key.length !== 8) {
      console.error(`❌ Key "${key}" has length ${key.length}, expected 8`);
      valid = false;
    }
    
    // Check key is sorted alphabetically
    const sortedKey = key.split('').sort().join('');
    if (key !== sortedKey) {
      console.error(`❌ Key "${key}" is not sorted alphabetically`);
      valid = false;
    }
    
    // Check key only contains letters A-L
    if (!/^[A-L]{8}$/.test(key)) {
      console.error(`❌ Key "${key}" contains invalid characters. Only A-L allowed`);
      valid = false;
    }
    
    // Check key has no repeated letters
    const uniqueChars = new Set(key.split(''));
    if (uniqueChars.size !== 8) {
      console.error(`❌ Key "${key}" has repeated letters`);
      valid = false;
    }
  }
  
  if (valid) {
    console.log('✅ All keys are valid (8 letters, sorted, A-L only, no repeats)');
  }
  
  return valid;
}

function validateColumnStructure(data: AnnexCData): boolean {
  const requiredColumns = ['option', '1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];
  let valid = true;
  
  for (const [key, entry] of Object.entries(data)) {
    const entryColumns = Object.keys(entry);
    
    for (const col of requiredColumns) {
      if (!entryColumns.includes(col)) {
        console.error(`❌ Entry "${key}" missing column "${col}"`);
        valid = false;
      }
    }
    
    if (entryColumns.length !== requiredColumns.length) {
      console.error(`❌ Entry "${key}" has ${entryColumns.length} columns, expected ${requiredColumns.length}`);
      valid = false;
    }
  }
  
  if (valid) {
    console.log('✅ All entries have correct column structure');
  }
  
  return valid;
}

function validateColumnValues(data: AnnexCData): boolean {
  let valid = true;
  const valueColumns = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'] as const;
  
  for (const [key, entry] of Object.entries(data)) {
    for (const col of valueColumns) {
      const value = entry[col];
      
      // Check value is a single letter A-L
      if (!/^[A-L]$/.test(value)) {
        console.error(`❌ Entry "${key}" column "${col}" has invalid value "${value}"`);
        valid = false;
      }
    }
    
    // Check no repeated values in the row
    const values = valueColumns.map(col => entry[col]);
    const uniqueValues = new Set(values);
    if (uniqueValues.size !== 8) {
      console.error(`❌ Entry "${key}" has repeated values in row`);
      valid = false;
    }
    
    // Check sorted values match the key
    const sortedValues = values.sort().join('');
    if (sortedValues !== key) {
      console.error(`❌ Entry "${key}" sorted values "${sortedValues}" do not match key "${key}"`);
      valid = false;
    }
  }
  
  if (valid) {
    console.log('✅ All column values are valid (A-L only, no repeats, match key)');
  }
  
  return valid;
}

function validateCombinations(data: AnnexCData): boolean {
  // Calculate C(12, 8) = 495
  const expectedCount = 495;
  const actualCount = Object.keys(data).length;
  
  if (actualCount !== expectedCount) {
    console.error(`❌ Expected C(12,8) = ${expectedCount} combinations, found ${actualCount}`);
    return false;
  }
  
  // Generate all possible combinations of 8 letters from A-L
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const allCombinations = new Set<string>();
  
  function generateCombinations(start: number, current: string[]): void {
    if (current.length === 8) {
      allCombinations.add(current.join(''));
      return;
    }
    
    for (let i = start; i < letters.length; i++) {
      generateCombinations(i + 1, [...current, letters[i]]);
    }
  }
  
  generateCombinations(0, []);
  
  const dataKeys = new Set(Object.keys(data));
  const missingCombinations: string[] = [];
  const extraCombinations: string[] = [];
  
  for (const combo of allCombinations) {
    if (!dataKeys.has(combo)) {
      missingCombinations.push(combo);
    }
  }
  
  for (const key of dataKeys) {
    if (!allCombinations.has(key)) {
      extraCombinations.push(key);
    }
  }
  
  if (missingCombinations.length > 0) {
    console.error(`❌ Missing ${missingCombinations.length} combinations: ${missingCombinations.slice(0, 10).join(', ')}${missingCombinations.length > 10 ? '...' : ''}`);
    return false;
  }
  
  if (extraCombinations.length > 0) {
    console.error(`❌ Found ${extraCombinations.length} extra combinations: ${extraCombinations.slice(0, 10).join(', ')}${extraCombinations.length > 10 ? '...' : ''}`);
    return false;
  }
  
  console.log('✅ All C(12,8) = 495 combinations present, no missing or extra');
  return true;
}

function validateDuplicateKeys(data: AnnexCData): boolean {
  const keys = Object.keys(data);
  const uniqueKeys = new Set(keys);
  
  if (keys.length !== uniqueKeys.size) {
    console.error(`❌ Found duplicate keys`);
    return false;
  }
  
  console.log('✅ No duplicate keys');
  return true;
}

function validateOption1(data: AnnexCData): boolean {
  const option1Key = 'EFGHIJKL';
  const option1Entry = data[option1Key];
  
  if (!option1Entry) {
    console.error(`❌ Option 1 not found with key "${option1Key}"`);
    return false;
  }
  
  if (option1Entry.option !== 1) {
    console.error(`❌ Option 1 has incorrect option number: ${option1Entry.option}`);
    return false;
  }
  
  const expected: AnnexCEntry = {
    option: 1,
    '1A': 'E',
    '1B': 'J',
    '1D': 'I',
    '1E': 'F',
    '1G': 'H',
    '1I': 'G',
    '1K': 'L',
    '1L': 'K'
  };
  
  for (const [col, expectedValue] of Object.entries(expected)) {
    if (option1Entry[col as keyof AnnexCEntry] !== expectedValue) {
      console.error(`❌ Option 1 column "${col}" is "${option1Entry[col as keyof AnnexCEntry]}", expected "${expectedValue}"`);
      return false;
    }
  }
  
  console.log('✅ Option 1 matches PDF specification');
  return true;
}

function validateOption1Transformation(data: AnnexCData): boolean {
  const option1Key = 'EFGHIJKL';
  const option1Entry = data[option1Key];
  
  if (!option1Entry) {
    console.error(`❌ Cannot validate transformation, option 1 not found`);
    return false;
  }
  
  // Internal order from SLOT_PATTERNS:
  // 0 -> rival 1E
  // 1 -> rival 1I
  // 2 -> rival 1A
  // 3 -> rival 1L
  // 4 -> rival 1D
  // 5 -> rival 1G
  // 6 -> rival 1B
  // 7 -> rival 1K
  
  const internalOrder = [
    option1Entry['1E'], // index 0
    option1Entry['1I'], // index 1
    option1Entry['1A'], // index 2
    option1Entry['1L'], // index 3
    option1Entry['1D'], // index 4
    option1Entry['1G'], // index 5
    option1Entry['1B'], // index 6
    option1Entry['1K'], // index 7
  ];
  
  const expectedTransformation = ['F', 'G', 'E', 'K', 'I', 'H', 'J', 'L'];
  
  for (let i = 0; i < internalOrder.length; i++) {
    if (internalOrder[i] !== expectedTransformation[i]) {
      console.error(`❌ Option 1 transformation at index ${i} is "${internalOrder[i]}", expected "${expectedTransformation[i]}"`);
      console.error(`   Actual transformation: [${internalOrder.join(', ')}]`);
      console.error(`   Expected transformation: [${expectedTransformation.join(', ')}]`);
      return false;
    }
  }
  
  console.log('✅ Option 1 transforms to ["F", "G", "E", "K", "I", "H", "J", "L"]');
  return true;
}

// ============================================================================
// MAIN VALIDATION
// ============================================================================

function main(): void {
  console.log('=== Validating Annex C 2026 Data ===\n');
  
  const data = annexCData as AnnexCData;
  
  const results = [
    validateEntryCount(data),
    validateOptionNumbers(data),
    validateKeys(data),
    validateColumnStructure(data),
    validateColumnValues(data),
    validateCombinations(data),
    validateDuplicateKeys(data),
    validateOption1(data),
    validateOption1Transformation(data),
  ];
  
  console.log('\n=== Validation Summary ===');
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`✅ All ${total} validations passed`);
    process.exit(0);
  } else {
    console.log(`❌ ${total - passed} of ${total} validations failed`);
    process.exit(1);
  }
}

main();
