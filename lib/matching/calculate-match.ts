import type { TrialCriteria } from './parse-criteria';
import type { PatientData } from './extract-patient';

export interface MatchResult {
  score: number;
  breakdown: {
    age?: boolean;
    gender?: boolean;
    conditions?: boolean;
    location?: boolean;
  };
}

export function calculateMatch(
  patient: PatientData,
  criteria: TrialCriteria
): MatchResult {
  let score = 0;
  const breakdown: MatchResult['breakdown'] = {};

  // Age check (25 points)
  if (criteria.age && patient.age) {
    const ageMin = criteria.age.min || 0;
    const ageMax = criteria.age.max || 999;
    if (patient.age >= ageMin && patient.age <= ageMax) {
      score += 25;
      breakdown.age = true;
    } else {
      breakdown.age = false;
    }
  }

  // Gender check (20 points)
  if (criteria.gender && patient.gender && patient.gender !== 'unknown') {
    const genderMatch = criteria.gender
      .map((g) => g.toLowerCase())
      .includes(patient.gender.toLowerCase());
    if (genderMatch) {
      score += 20;
      breakdown.gender = true;
    } else {
      breakdown.gender = false;
    }
  }

  // Conditions check (40 points) - Most important!
  if (criteria.conditions && patient.conditions && patient.conditions.length > 0) {
    const hasMatchingCondition = criteria.conditions.some((requiredCondition) =>
      patient.conditions.some(
        (patientCondition) =>
          patientCondition
            .toLowerCase()
            .includes(requiredCondition.toLowerCase()) ||
          requiredCondition
            .toLowerCase()
            .includes(patientCondition.toLowerCase())
      )
    );
    if (hasMatchingCondition) {
      score += 40;
      breakdown.conditions = true;
    } else {
      breakdown.conditions = false;
    }
  }

  // Location check (15 points)
  if (criteria.location && patient.location) {
    const locationMatch = patient.location
      .toLowerCase()
      .includes(criteria.location.toLowerCase());
    if (locationMatch) {
      score += 15;
      breakdown.location = true;
    } else {
      breakdown.location = false;
    }
  }

  return { score, breakdown };
}
