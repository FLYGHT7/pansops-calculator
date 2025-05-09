/**
 * Handles unit selection change without converting the displayed value
 * @param {string} inputId - ID of the input element
 * @param {string} unitSelectId - ID of the unit select element
 */
function handleUnitChange(inputId, unitSelectId) {
  const unitSelect = document.getElementById(unitSelectId)

  // Just update the last unit - no conversion in the UI
  unitSelect.dataset.lastUnit = unitSelect.value

  // No need to convert the value in the input field
  // The conversion will happen only during calculations
}

/**
 * Gets the value from an input in the specified unit for calculations
 * @param {string} inputId - ID of the input element
 * @param {string} unitId - ID of the unit select element
 * @param {string} targetUnit - The unit to convert to ('ft', 'm', 'feet', 'meters', etc.)
 * @return {number} The value in the target unit
 */
function getValueInUnit(inputId, unitId, targetUnit) {
  const input = document.getElementById(inputId)
  const unitSelect = document.getElementById(unitId)
  const value = Number.parseFloat(input.value)

  if (isNaN(value)) {
    return Number.NaN
  }

  const currentUnit = unitSelect.value

  // If units are the same, no conversion needed
  if (currentUnit === targetUnit) {
    return value
  }

  // Convert based on the units (handling both 'ft'/'m' and 'feet'/'meters' formats)
  if ((currentUnit === "ft" || currentUnit === "feet") && (targetUnit === "m" || targetUnit === "meters")) {
    return value * 0.3048
  } else if ((currentUnit === "m" || currentUnit === "meters") && (targetUnit === "ft" || targetUnit === "feet")) {
    return value / 0.3048
  }

  // Default case - no conversion
  return value
}
