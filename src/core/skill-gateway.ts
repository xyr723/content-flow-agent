import type {
  ContentPackage,
  PlatformDraft,
  PlatformId,
  PublishResult,
} from "./types.js";
import type { PlatformSkill } from "./platform-skill.js";

export class SkillGateway {
  private readonly skills = new Map<PlatformId, PlatformSkill>();

  register(skill: PlatformSkill): void {
    this.skills.set(skill.id, skill);
  }

  get(platform: PlatformId): PlatformSkill {
    const skill = this.skills.get(platform);
    if (!skill) {
      throw new Error(`Platform skill is not registered: ${platform}`);
    }
    return skill;
  }

  async adapt(input: ContentPackage): Promise<PlatformDraft[]> {
    return Promise.all(
      input.targetPlatforms.map((platform) => this.get(platform).adapt(input)),
    );
  }

  async publish(drafts: PlatformDraft[]): Promise<PublishResult[]> {
    return Promise.all(
      drafts.map((draft) => this.get(draft.platform).publish(draft)),
    );
  }
}
