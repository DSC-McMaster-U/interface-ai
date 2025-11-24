# Step Creator Demo

The **Step Creator** is a core component of Interface AI that breaks down high-level user intents into specific, actionable browser automation steps.

## 🎯 What It Does

Given a user intent like "book a flight from Toronto to NYC", the Step Creator generates a sequence of granular steps:

```json
[
  {"action": "navigate", "target": "flight booking website", "value": "google.com/flights", "description": "Navigate to Google Flights"},
  {"action": "click", "target": "departure input", "value": "", "description": "Click on the departure city input field"},
  {"action": "type", "target": "departure input", "value": "Toronto", "description": "Type 'Toronto' in departure field"},
  ...
]
```

## 🚀 Quick Start

### Option 1: Interactive Demo
```bash
cd backend/app
python demo_step_creator.py
```

This launches an interactive shell where you can type intents and see the generated steps.

### Option 2: Command Line
```bash
cd backend/app
python step_creator.py "your intent here"
```

Example:
```bash
python step_creator.py "message my first instagram DM hello"
```

## 🔑 AI Provider Options

The Step Creator supports three modes:

### 1. **OpenAI** (Recommended)
- Most sophisticated step generation
- Requires: `OPENAI_API_KEY` environment variable
- Model: `gpt-4o-mini`

```bash
export OPENAI_API_KEY="your-key-here"
python demo_step_creator.py
```

### 2. **Anthropic Claude**
- High-quality step generation
- Requires: `ANTHROPIC_API_KEY` environment variable
- Model: `claude-3-5-sonnet-20241022`

```bash
export ANTHROPIC_API_KEY="your-key-here"
python demo_step_creator.py
```

### 3. **Fallback Mode** (No API Key)
- Basic pattern matching
- Works offline, no API required
- Limited to common patterns (messaging, flight booking, etc.)

## 📋 Example Intents

Try these example intents:

- `message my first instagram DM hello`
- `book a flight from Toronto to New York`
- `open my calculus lecture on YouTube`
- `create a new AWS EC2 instance`
- `order pizza from Dominos`
- `find and apply to software engineering jobs`
- `search for restaurants near me on Google Maps`

## 🏗️ Architecture

```
Step Creator
├── create_steps_with_openai()    # Uses OpenAI GPT for step generation
├── create_steps_with_anthropic() # Uses Anthropic Claude for step generation
├── create_steps_fallback()       # Pattern-based fallback (no API)
└── create_steps()                # Main entry point (auto-selects provider)
```

## 📊 Step Format

Each step contains:

| Field | Type | Description |
|-------|------|-------------|
| `action` | string | Type of action (navigate, click, type, wait, search, scroll, etc.) |
| `target` | string | What element or location to interact with |
| `value` | string | Value to input (for type actions) or additional context |
| `description` | string | Human-readable description of the step |

## 🔄 Integration

To integrate the Step Creator into your Flask app:

```python
from step_creator import create_steps

@app.route("/api/create-steps", methods=["POST"])
def api_create_steps():
    data = request.get_json()
    user_intent = data.get("intent", "")
    
    steps = create_steps(user_intent)
    
    return jsonify({"steps": steps}), 200
```

## 🧪 Testing

Run the step creator with different intents to test:

```bash
# Test with OpenAI
OPENAI_API_KEY="your-key" python step_creator.py "your intent"

# Test with Anthropic
ANTHROPIC_API_KEY="your-key" python step_creator.py "your intent"

# Test fallback mode
python step_creator.py "message someone on instagram"
```

## 🎨 Customization

### Modify the System Prompt
Edit `create_steps_with_openai()` or `create_steps_with_anthropic()` to customize how steps are generated:

```python
system_prompt = """You are a web automation task planner...
- Add your custom instructions here
- Specify output format
- Define action types
"""
```

### Add New Fallback Patterns
Extend `create_steps_fallback()` to handle more intents without API:

```python
if "your pattern" in intent_lower:
    steps = [
        {"action": "...", "target": "...", "value": "...", "description": "..."},
        ...
    ]
```

## 🔮 Next Steps

After generating steps, the next components in the pipeline:

1. **Vision AI Model** - Locates UI elements matching step targets
2. **Action Performer** - Executes the steps using Playwright
3. **Status Vision AI** - Monitors progress and handles errors

## 📝 Notes

- The fallback mode uses simple pattern matching and is limited
- For production use, OpenAI or Anthropic is highly recommended
- Steps are intentionally atomic - one action per step
- The system prompt can be tuned for domain-specific tasks

## 🐛 Troubleshooting

**Issue**: "OpenAI library not installed"
```bash
pip install openai anthropic
```

**Issue**: "OPENAI_API_KEY not found"
```bash
export OPENAI_API_KEY="sk-..."
```

**Issue**: Steps seem generic or incorrect
- Try using OpenAI/Anthropic instead of fallback mode
- Adjust the system prompt for more specific guidance
- Provide more context in your intent

## 📚 Resources

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Interface AI Main README](../../README.md)
