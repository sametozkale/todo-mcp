import { PostHog } from "posthog-node";

let _posthog: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      enableExceptionAutocapture: true,
    });
  }
  return _posthog;
}
