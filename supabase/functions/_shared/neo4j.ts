import neo4j from "https://esm.sh/neo4j-driver@5.17.0?bundle";

const uri = Deno.env.get("NEO4J_URI") || "";
const user = Deno.env.get("NEO4J_USER") || "";
const password = Deno.env.get("NEO4J_PASSWORD") || "";

if (!uri || !user || !password) {
  console.error("Missing Neo4j environment variables");
}

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export async function getNeo4jSession() {
  return driver.session();
}

export async function closeNeo4jDriver() {
  await driver.close();
}

export { driver };
