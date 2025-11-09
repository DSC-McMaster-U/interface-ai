const API = "http://localhost:5000/api/relay";

async function send() {
  const input = document.getElementById("msg");
  const out = document.getElementById("out");
  const message = input.value.trim();
  out.textContent = "Sending...";
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    out.textContent = `Response: ${data.echo}`;
  } catch (e) {
    out.textContent = `Error: ${e.message}`;
  }
}

document.getElementById("send").addEventListener("click", send);
