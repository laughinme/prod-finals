import apiProtected from "./axiosInstance";
import {
  OnboardingAnswersRequestDto,
  OnboardingAnswersResponseDto,
  OnboardingConfigResponseDto,
  OnboardingStateDto,
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
  importTransactionsEnabled?: boolean;
  importTransactionsDefault?: boolean;
  importTransactionsValue?: boolean | null;
}

export interface OnboardingConfigResponse {
  steps: OnboardingStep[];
}

export interface OnboardingState {
  quizStarted: boolean;
  skipped: boolean;
  completed: boolean;
  shouldShow: boolean;
  currentStepKey?: string | null;
  requiredProfileStepKey?: string | null;
  missingRequiredFields: string[];
  completedStepKeys: string[];
  answersByStep: Record<string, string[]>;
}

export interface OnboardingAnswersRequest {
  stepKey: string;
  answers: string[];
  importTransactions?: boolean;
}

export interface OnboardingAnswersResponse extends OnboardingState {
  stepKey: string;
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
  importTransactionsEnabled: dto.import_transactions_enabled,
  importTransactionsDefault: dto.import_transactions_default,
  importTransactionsValue: dto.import_transactions_value,
});

const toConfigResponse = (
  dto: OnboardingConfigResponseDto,
): OnboardingConfigResponse => ({
  steps: dto.steps.map(toStep),
});

const toOnboardingState = (dto: OnboardingStateDto): OnboardingState => ({
  quizStarted: dto.quiz_started,
  skipped: dto.skipped,
  completed: dto.completed,
  shouldShow: dto.should_show,
  currentStepKey: dto.current_step_key ?? null,
  requiredProfileStepKey: dto.required_profile_step_key ?? null,
  missingRequiredFields: dto.missing_required_fields ?? [],
  completedStepKeys: dto.completed_step_keys ?? [],
  answersByStep: dto.answers_by_step ?? {},
});

const toAnswersResponse = (
  dto: OnboardingAnswersResponseDto,
): OnboardingAnswersResponse => ({
  stepKey: dto.step_key,
  saved: dto.saved,
  ...toOnboardingState(dto),
});

const toAnswersRequestDto = (
  data: OnboardingAnswersRequest,
): OnboardingAnswersRequestDto => ({
  step_key: data.stepKey,
  answers: data.answers,
  import_transactions: data.importTransactions,
});

export const getOnboardingConfig =
  async (): Promise<OnboardingConfigResponse> => {
    const response =
      await apiProtected.get<OnboardingConfigResponseDto>("/onboarding/config");
    return toConfigResponse(response.data);
  };

export const getOnboardingState = async (): Promise<OnboardingState> => {
  const response = await apiProtected.get<OnboardingStateDto>("/onboarding/state");
  return toOnboardingState(response.data);
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

export const postOnboardingSkip = async (): Promise<OnboardingState> => {
  const response = await apiProtected.post<OnboardingStateDto>("/onboarding/skip");
  return toOnboardingState(response.data);
};
