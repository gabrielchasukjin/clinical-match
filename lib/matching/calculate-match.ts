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
  weights?: {
    age: number;
    gender: number;
    conditions: number;
    location: number;
  };
}

// Calculate dynamic weights based on which criteria are specified
function calculateWeights(criteria: TrialCriteria) {
  const weights = {
    age: 0,
    gender: 0,
    conditions: 0,
    location: 0,
  };

  // Use priorityOrder from AI if available, otherwise use specified criteria
  let specifiedCriteria: Array<'conditions' | 'location' | 'age' | 'gender'> =
    [];

  if (criteria.priorityOrder && criteria.priorityOrder.length > 0) {
    // Use the order from AI analysis
    specifiedCriteria = criteria.priorityOrder.filter((field) => {
      // Verify the field is actually specified
      if (field === 'conditions')
        return criteria.conditions && criteria.conditions.length > 0;
      if (field === 'gender')
        return criteria.gender && criteria.gender.length > 0;
      if (field === 'age') return criteria.age && (criteria.age.min || criteria.age.max);
      if (field === 'location') return !!criteria.location;
      return false;
    });
  } else {
    // Fallback: detect which criteria are specified
    if (criteria.conditions && criteria.conditions.length > 0) {
      specifiedCriteria.push('conditions');
    }
    if (criteria.gender && criteria.gender.length > 0) {
      specifiedCriteria.push('gender');
    }
    if (criteria.age && (criteria.age.min || criteria.age.max)) {
      specifiedCriteria.push('age');
    }
    if (criteria.location) {
      specifiedCriteria.push('location');
    }
  }

  const specifiedCount = specifiedCriteria.length;

  if (specifiedCount === 0) {
    // Default weights if nothing specified
    return { age: 25, gender: 20, conditions: 40, location: 15 };
  }

  // Distribute 100 points based on priority (order in specifiedCriteria array)
  // First criterion gets most weight, decreasing for subsequent ones
  if (specifiedCount === 1) {
    weights[specifiedCriteria[0]] = 100;
  } else if (specifiedCount === 2) {
    weights[specifiedCriteria[0]] = 60; // Primary: 60%
    weights[specifiedCriteria[1]] = 30; // Secondary: 30%
    // Remaining 10% distributed to unspecified criteria
    const unspecified = (['age', 'gender', 'conditions', 'location'] as const).filter(
      (f) => !specifiedCriteria.includes(f)
    );
    unspecified.forEach((f) => {
      weights[f] = 5;
    });
  } else if (specifiedCount === 3) {
    weights[specifiedCriteria[0]] = 50; // Primary: 50%
    weights[specifiedCriteria[1]] = 30; // Secondary: 30%
    weights[specifiedCriteria[2]] = 15; // Tertiary: 15%
    // Remaining 5% to unspecified
    const unspecified = (['age', 'gender', 'conditions', 'location'] as const).filter(
      (f) => !specifiedCriteria.includes(f)
    );
    if (unspecified.length > 0) {
      weights[unspecified[0]] = 5;
    }
  } else {
    // All 4 criteria specified
    weights[specifiedCriteria[0]] = 40; // Primary: 40%
    weights[specifiedCriteria[1]] = 30; // Secondary: 30%
    weights[specifiedCriteria[2]] = 20; // Tertiary: 20%
    weights[specifiedCriteria[3]] = 10; // Quaternary: 10%
  }

  return weights;
}

export function calculateMatch(
  patient: PatientData,
  criteria: TrialCriteria
): MatchResult {
  let score = 0;
  const breakdown: MatchResult['breakdown'] = {};

  // Calculate dynamic weights based on user input
  const weights = calculateWeights(criteria);

  // Age check
  if (criteria.age && patient.age) {
    const ageMin = criteria.age.min || 0;
    const ageMax = criteria.age.max || 999;
    if (patient.age >= ageMin && patient.age <= ageMax) {
      score += weights.age;
      breakdown.age = true;
    } else {
      breakdown.age = false;
    }
  }

  // Gender check
  if (criteria.gender && patient.gender && patient.gender !== 'unknown') {
    const genderMatch = criteria.gender
      .map((g) => g.toLowerCase().trim())
      .includes(patient.gender.toLowerCase().trim());
    if (genderMatch) {
      score += weights.gender;
      breakdown.gender = true;
    } else {
      breakdown.gender = false;
    }
  }

  // Conditions check
  if (criteria.conditions && patient.conditions && patient.conditions.length > 0) {
    // Extract to const to preserve type narrowing in nested callbacks
    const patientConditions = patient.conditions;

    const hasMatchingCondition = criteria.conditions.some((requiredCondition) => {
      const requiredLower = requiredCondition.toLowerCase().trim();

      return patientConditions.some((patientCondition) => {
        const patientLower = patientCondition.toLowerCase().trim();

        // 1. Exact substring match (most specific)
        if (patientLower.includes(requiredLower) || requiredLower.includes(patientLower)) {
          return true;
        }

        // 2. Extract medical keywords (organs, body parts, major terms)
        // This allows "heart failure" to match "heart attack", "heart surgery", etc.
        const medicalKeywords = [
          'heart', 'lung', 'kidney', 'liver', 'brain', 'cancer', 'diabetes',
          'stroke', 'arthritis', 'asthma', 'copd', 'dementia', 'alzheimer',
          'parkinson', 'ms', 'multiple sclerosis', 'als', 'leukemia', 'lymphoma',
          'breast', 'prostate', 'colon', 'pancreatic', 'ovarian', 'melanoma',
          'cardiomyopathy', 'congestive', 'pulmonary', 'renal', 'hepatic',
          'neurological', 'cardiovascular', 'respiratory', 'oncology'
        ];

        // Extract significant keywords from both conditions
        const requiredKeywords = medicalKeywords.filter(keyword =>
          requiredLower.includes(keyword)
        );

        const patientKeywords = medicalKeywords.filter(keyword =>
          patientLower.includes(keyword)
        );

        // If they share at least one significant medical keyword, consider it a match
        const hasSharedKeyword = requiredKeywords.some(keyword =>
          patientKeywords.includes(keyword)
        );

        if (hasSharedKeyword) {
          return true;
        }

        // 3. Common medical synonyms and related terms
        const relatedTerms: Record<string, string[]> = {
          'cancer': ['tumor', 'carcinoma', 'sarcoma', 'leukemia', 'lymphoma', 'melanoma', 'oncology'],
          'tumor': ['cancer', 'carcinoma', 'sarcoma', 'mass', 'neoplasm'],
          'diabetes': ['diabetic', 'hyperglycemia', 'insulin'],
          'stroke': ['cerebrovascular', 'cva', 'brain attack'],
          'copd': ['chronic obstructive pulmonary', 'emphysema', 'chronic bronchitis'],
          'mi': ['myocardial infarction', 'heart attack'],
          'chf': ['congestive heart failure', 'heart failure'],
        };

        // Check if either condition is a synonym of the other
        for (const [term, synonyms] of Object.entries(relatedTerms)) {
          if (requiredLower.includes(term)) {
            if (synonyms.some(syn => patientLower.includes(syn))) {
              return true;
            }
          }
          if (patientLower.includes(term)) {
            if (synonyms.some(syn => requiredLower.includes(syn))) {
              return true;
            }
          }
        }

        return false;
      });
    });

    if (hasMatchingCondition) {
      score += weights.conditions;
      breakdown.conditions = true;
    } else {
      breakdown.conditions = false;
    }
  }

  // Location check
  if (criteria.location && patient.location) {
    const criteriaLoc = criteria.location.toLowerCase().trim();
    const patientLoc = patient.location.toLowerCase().trim();

    // Check for direct substring match first
    let locationMatch = patientLoc.includes(criteriaLoc);

    // If no direct match, check for state abbreviation matching
    if (!locationMatch) {
      // Map common state names to abbreviations
      const stateMap: Record<string, string[]> = {
        'new york': ['ny', 'n.y.'],
        'california': ['ca', 'calif'],
        'texas': ['tx'],
        'florida': ['fl', 'fla'],
        'pennsylvania': ['pa'],
        'illinois': ['il'],
        'ohio': ['oh'],
        'georgia': ['ga'],
        'north carolina': ['nc', 'n.c.'],
        'michigan': ['mi'],
        'new jersey': ['nj', 'n.j.'],
        'virginia': ['va'],
        'washington': ['wa'],
        'arizona': ['az'],
        'massachusetts': ['ma', 'mass'],
        'tennessee': ['tn'],
        'indiana': ['in'],
        'missouri': ['mo'],
        'maryland': ['md'],
        'wisconsin': ['wi'],
        'colorado': ['co'],
        'minnesota': ['mn'],
        'south carolina': ['sc', 's.c.'],
        'alabama': ['al'],
        'louisiana': ['la'],
        'kentucky': ['ky'],
        'oregon': ['or'],
        'oklahoma': ['ok'],
        'connecticut': ['ct'],
        'utah': ['ut'],
        'iowa': ['ia'],
        'nevada': ['nv'],
        'arkansas': ['ar'],
        'mississippi': ['ms'],
        'kansas': ['ks'],
        'new mexico': ['nm', 'n.m.'],
        'nebraska': ['ne'],
        'west virginia': ['wv', 'w.v.'],
        'idaho': ['id'],
        'hawaii': ['hi'],
        'new hampshire': ['nh', 'n.h.'],
        'maine': ['me'],
        'rhode island': ['ri', 'r.i.'],
        'montana': ['mt'],
        'delaware': ['de'],
        'south dakota': ['sd', 's.d.'],
        'north dakota': ['nd', 'n.d.'],
        'alaska': ['ak'],
        'vermont': ['vt'],
        'wyoming': ['wy'],
      };

      // Check if criteria is a state name and patient location ends with its abbreviation
      for (const [stateName, abbreviations] of Object.entries(stateMap)) {
        if (criteriaLoc === stateName) {
          // Check if patient location ends with any abbreviation of this state
          locationMatch = abbreviations.some(abbr =>
            patientLoc.endsWith(abbr) || patientLoc.endsWith(abbr + '.')
          );
          if (locationMatch) break;
        }

        // Also check reverse: if criteria is abbreviation and patient has full state name
        if (abbreviations.includes(criteriaLoc)) {
          locationMatch = patientLoc.includes(stateName);
          if (locationMatch) break;
        }
      }
    }

    if (locationMatch) {
      score += weights.location;
      breakdown.location = true;
    } else {
      breakdown.location = false;
    }
  }

  return { score, breakdown, weights };
}
