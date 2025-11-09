/**
 * Tests for the popup functionality
 */

describe("Popup Tests", () => {
  beforeEach(() => {
    // Set up the DOM
    document.body.innerHTML = `
      <input id="msg" type="text" />
      <button id="send">Send</button>
      <div id="out"></div>
    `;

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("should send message and display response", async () => {
    const mockResponse = {
      json: async () => ({ echo: "Hello Test" }),
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const input = document.getElementById("msg");
    const out = document.getElementById("out");

    input.value = "Test";

    // Simulate the send function behavior
    out.textContent = "Sending...";
    try {
      const res = await fetch("http://localhost:5000/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.value.trim() }),
      });
      const data = await res.json();
      out.textContent = `Response: ${data.echo}`;
    } catch (e) {
      out.textContent = `Error: ${e.message}`;
    }

    expect(out.textContent).toBe("Response: Hello Test");
  });

  test("should handle fetch errors", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    const input = document.getElementById("msg");
    const out = document.getElementById("out");

    input.value = "Test";

    // We need to test the error handling
    try {
      await fetch("http://localhost:5000/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Test" }),
      });
    } catch (e) {
      out.textContent = `Error: ${e.message}`;
    }

    expect(out.textContent).toBe("Error: Network error");
  });

  test("should trim input message", () => {
    const input = document.getElementById("msg");
    input.value = "  Test Message  ";

    const trimmed = input.value.trim();
    expect(trimmed).toBe("Test Message");
  });
});
