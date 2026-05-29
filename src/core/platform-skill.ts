import type {
  ContentPackage,
  MediaType,
  PlatformDraft,
  PlatformId,
  PublishResult,
  ValidationResult,
} from "./types.js";

export interface PlatformSkill {
  id: PlatformId;
  displayName: string;
  supportedMedia: Array<"text" | MediaType>;
  adapt(input: ContentPackage): Promise<PlatformDraft>;
  validate(draft: PlatformDraft): Promise<ValidationResult>;
  publish(draft: PlatformDraft): Promise<PublishResult>;
}
