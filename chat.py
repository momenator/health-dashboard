"""Interactive terminal chat client for testing the health chatbot."""

import json
import os
import sys

# Set environment before importing app modules
os.environ.setdefault("ENABLE_BEDROCK", "true")
os.environ.setdefault("AWS_REGION", "us-west-2")
os.environ.setdefault("BEDROCK_MODEL_ID", "us.mistral.pixtral-large-2502-v1:0")

from app.core.config import get_settings
get_settings.cache_clear()

from app.router import handle_chat


def main():
    print("=" * 60)
    print("  AI4Good Health Chatbot - Terminal Mode")
    print("=" * 60)
    print()
    print("Type your questions below. Type 'quit' or 'exit' to stop.")
    print("Type 'json' to toggle raw JSON output.")
    print()

    show_json = False

    while True:
        try:
            message = input("\033[1mYou:\033[0m ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nBye!")
            break

        if not message:
            continue
        if message.lower() in ("quit", "exit", "q"):
            print("Bye!")
            break
        if message.lower() == "json":
            show_json = not show_json
            print(f"  [JSON mode: {'ON' if show_json else 'OFF'}]")
            continue

        print()
        try:
            resp = handle_chat(message)

            if show_json:
                print(json.dumps(resp.model_dump(), indent=2, default=str))
            else:
                # Pretty print
                print(f"\033[1m[{resp.type.upper()}]\033[0m")
                print()
                print(resp.answer)

                if resp.chart:
                    print(f"\n  📊 Chart: {resp.chart.type} — {resp.chart.title}")
                    if resp.chart.data:
                        for row in resp.chart.data[:5]:
                            print(f"     {row}")
                        if len(resp.chart.data) > 5:
                            print(f"     ... ({len(resp.chart.data)} rows total)")

                if resp.quality_note:
                    print(f"\n  ⚠️  {resp.quality_note}")

                if resp.suggested_followups:
                    print("\n  💡 Try asking:")
                    for f in resp.suggested_followups:
                        print(f"     - {f}")

        except Exception as e:
            print(f"\033[31mError: {e}\033[0m")

        print()


if __name__ == "__main__":
    main()
