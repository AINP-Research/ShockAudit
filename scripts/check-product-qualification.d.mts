export interface ProductQualificationResult {
  issues: string[];
  artifactCount: number;
}

export function validateProductQualification(
  inputRoot: string,
): Promise<ProductQualificationResult>;
