import apiProtected from "./axiosInstance";
import {
  OnboardingAnswersRequestDto,
  OnboardingAnswersResponseDto,
  OnboardingConfigResponseDto,
  OnboardingStepDto,
} from "./onboarding-dto";

export type OnboardingStepType = "single_select" | "multi_select" | "range";

export interface OnboardingStepOption {
  value: string;
  label: string;
}

export interface OnboardingStep {
  stepKey: string;
  title: string;
  description?: string | null;
  stepType: OnboardingStepType;
  requiredForFeed: boolean;
  options: OnboardingStepOption[];
  minAnswers?: number | null;
  maxAnswers?: number | null;
  optional?: boolean;
  rangeMin?: number | null;
  rangeMax?: number | null;
  rangeMinLabel?: string | null;
  rangeMaxLabel?: string | null;
}

export interface OnboardingConfigResponse {
  steps: OnboardingStep[];
}

export interface OnboardingAnswersRequest {
  stepKey: string;
  answers: string[];
}

export interface OnboardingAnswersResponse {
  stepKey: string;
  quizStarted: boolean;
  saved?: boolean;
}

const toStep = (dto: OnboardingStepDto): OnboardingStep => ({
  stepKey: dto.step_key,
  title: dto.title,
  description: dto.description,
  stepType: dto.step_type as OnboardingStepType,
  requiredForFeed: dto.required_for_feed,
  options: dto.options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    weight: opt.weight,
  })),
  minAnswers: dto.min_answers,
  maxAnswers: dto.max_answers,
  optional: dto.optional,
  rangeMin: dto.range_min,
  rangeMax: dto.range_max,
  rangeMinLabel: dto.range_min_label,
  rangeMaxLabel: dto.range_max_label,
});

const toConfigResponse = (
  dto: OnboardingConfigResponseDto,
): OnboardingConfigResponse => ({
  steps: dto.steps.map(toStep),
});

const toAnswersResponse = (
  dto: OnboardingAnswersResponseDto,
): OnboardingAnswersResponse => ({
  stepKey: dto.step_key,
  quizStarted: dto.quiz_started,
  saved: dto.saved,
});

const toAnswersRequestDto = (
  data: OnboardingAnswersRequest,
): OnboardingAnswersRequestDto => ({
  step_key: data.stepKey,
  answers: data.answers,
});

export const getOnboardingConfig =
  async (): Promise<OnboardingConfigResponse> => {
    const response =
      await apiProtected.get<OnboardingConfigResponseDto>("/onboarding/config");
    return toConfigResponse(response.data);
  };

export const postOnboardingAnswers = async (
  data: OnboardingAnswersRequest,
): Promise<OnboardingAnswersResponse> => {
  const response = await apiProtected.post<OnboardingAnswersResponseDto>(
    "/onboarding/answers",
    toAnswersRequestDto(data),
  );
  return toAnswersResponse(response.data);
};
