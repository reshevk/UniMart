import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("UniMart API", () => {
  it("returns a successful health response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("rejects access to protected chat routes without a token", async () => {
    const response = await request(app).get("/api/chat/conversations");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });
});
