import "https://deno.land/std@0.208.0/dotenv/load.ts";
import { getNeo4jSession } from '../supabase/functions/_shared/neo4j.ts';
import { generateContent } from '../supabase/functions/_shared/ai.ts';

async function testGraphConnection() {
    console.log("Testing Neo4j Connection...");
    const session = await getNeo4jSession();
    try {
        const result = await session.run('RETURN "Neo4j is Online" AS status');
        console.log(result.records[0].get('status'));
    } catch (error) {
        console.error("Neo4j Connection Failed:", error);
    } finally {
        await session.close();
    }
}

async function testAI() {
    console.log("Testing AI Generation...");
    try {
        const response = await generateContent("Hello, are you working?");
        console.log("AI Response:", response);
    } catch (error) {
        console.error("AI Generation Failed:", error);
    }
}

async function main() {
    await testGraphConnection();
    await testAI();
    Deno.exit(0);
}

main();
