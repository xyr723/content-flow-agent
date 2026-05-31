import type { PlatformSkill } from "../core/platform-skill.js";
import type {
  ContentPackage,
  MediaType,
  PlatformDraft,
  PlatformId,
  PublishResult,
  ValidationResult,
} from "../core/types.js";
import { MockPublisher } from "../publishing/publisher.js";
import { createDefaultDraftValidator } from "../validation/draft-validator.js";

export type ExternalPlatformSkill = {
  platform: PlatformId;
  displayName: string;
  supportedMedia: Array<"text" | MediaType>;
  adapt(input: ContentPackage): Promise<PlatformDraft>;
  validate?(draft: PlatformDraft): Promise<ValidationResult>;
  publish?(draft: PlatformDraft): Promise<PublishResult>;
};

export class ExternalSkillAdapter implements PlatformSkill {
  readonly id: PlatformId;
  readonly displayName: string;
  readonly supportedMedia: PlatformSkill["supportedMedia"];

  private readonly publisher: MockPublisher;
  private readonly validator = createDefaultDraftValidator();

  constructor(private readonly externalSkill: ExternalPlatformSkill) {
    this.id = externalSkill.platform;
    this.displayName = externalSkill.displayName;
    this.supportedMedia = externalSkill.supportedMedia;
    this.publisher = new MockPublisher(externalSkill.platform, externalSkill.displayName);
  }

  async adapt(input: ContentPackage): Promise<PlatformDraft> {
    const draft = await this.externalSkill.adapt(input);
    return {
      ...draft,
      platform: this.id,
    };
  }

  async validate(draft: PlatformDraft): Promise<ValidationResult> {
    return this.externalSkill.validate?.(draft) ?? this.validator.validate(draft);
  }

  async publish(draft: PlatformDraft): Promise<PublishResult> {
    return this.externalSkill.publish?.(draft) ?? this.publisher.publish(draft);
  }
}
