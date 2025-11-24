#!/usr/bin/env python3
"""
Interactive Step Creator Demo
Run this to test the Step Creator with your own intents
"""
from step_creator import create_steps, print_steps
import os

def main():
    print("\n" + "="*70)
    print("🤖 INTERFACE AI - STEP CREATOR DEMO")
    print("="*70)
    
    # Check API availability
    has_gemini = bool(os.getenv("GOOGLE_API_KEY"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    has_anthropic = bool(os.getenv("ANTHROPIC_API_KEY"))
    
    print("\n📊 Status:")
    print(f"  Gemini (GOOGLE_API_KEY): {'✓ Available' if has_gemini else '✗ Not configured'}")
    print(f"  OpenAI API: {'✓ Available' if has_openai else '✗ Not configured'}")
    print(f"  Anthropic API: {'✓ Available' if has_anthropic else '✗ Not configured'}")
    
    if not has_gemini and not has_openai and not has_anthropic:
        print("\n⚠️  Note: Using fallback mode (pattern matching)")
        print("   For better results, set GOOGLE_API_KEY (Gemini), OPENAI_API_KEY, or ANTHROPIC_API_KEY")
    
    print("\n" + "="*70)
    print("\n💡 Example intents to try:")
    print("  • message my first instagram DM hello")
    print("  • book a flight from Toronto to New York")
    print("  • open my calculus lecture on YouTube")
    print("  • create a new AWS EC2 instance")
    print("  • order pizza from Dominos")
    print("  • find and apply to software engineering jobs")
    print("\n" + "="*70)
    
    while True:
        print("\n")
        user_intent = input("Enter your intent (or 'quit' to exit): ").strip()
        
        if user_intent.lower() in ['quit', 'exit', 'q']:
            print("\n👋 Goodbye!\n")
            break
        
        if not user_intent:
            continue
        
        print(f"\n🎯 Processing: {user_intent}")
        steps = create_steps(user_intent)
        
        if steps:
            print_steps(steps)
            
            # Show JSON format
            import json
            print("📋 JSON Output:")
            print("-" * 60)
            print(json.dumps(steps, indent=2))
            print("-" * 60)
        else:
            print("\n❌ Failed to generate steps. Please try again.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted. Goodbye!\n")
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
