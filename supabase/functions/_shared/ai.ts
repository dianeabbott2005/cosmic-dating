const apiKey = Deno.env.get("GEMINI_API_KEY") || "";

if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable");
}

export async function generateContent(prompt: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error("Invalid response format from AI API");
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error generating content:", error);
        throw error;
    }
}
