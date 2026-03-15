export type OnboardingStepTypeDto = "single_select" | "multi_select" | "range";

export interface OnboardingStepOptionDto {
  value: string;
  label: string;
  weight?: number | null;
}

export interface OnboardingStepDto {
  step_key: string;
  title: string;
  description?: string | null;
  step_type: OnboardingStepTypeDto;
  required_for_feed: boolean;
  options: OnboardingStepOptionDto[];
  min_answers?: number | null;
  max_answers?: number | null;
  optional?: boolean;
  range_min?: number | null;
  range_max?: number | null;
  range_min_label?: string | null;
  range_max_label?: string | null;
  import_transactions_enabled?: boolean;
  import_transactions_default?: boolean;
  import_transactions_value?: boolean | null;
}

export interface OnboardingConfigResponseDto {
  steps: OnboardingStepDto[];
}

export interface OnboardingAnswersRequestDto {
  step_key: string;
  answers: string[];
  import_transactions?: boolean;
}

export interface OnboardingAnswersResponseDto {
  step_key: string;
  quiz_started: boolean;
  saved?: boolean;
}
