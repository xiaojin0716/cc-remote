import { expect, test } from "bun:test";
import { ClaudeAcpAgent } from "@agentclientprotocol/claude-agent-acp";

test("acpc gets both overall windows from the session SDK and reads at most once per minute", async () => {
  const five = { utilization: 0, resets_at: "2026-11-11T13:35:00Z" };
  const week = { utilization: 61, resets_at: "2026-11-14T01:10:00Z" };
  let response = { rate_limits_available: true, rate_limits: { five_hour: five, seven_day: week, seven_day_sonnet: { utilization: 99 } } };
  let reads = 0;
  const session = { query: { async usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET() { reads++; return response; } } };
  const messages = [];
  const agent = Object.assign(Object.create(ClaudeAcpAgent.prototype), {
    sessions: { sample: session }, client: { async sessionUpdate(message) { messages.push(message); } }
  });
  await agent.refreshAcpcLimits("sample");
  expect(reads).toBe(0);
  agent.acpcStatusLine = true;
  await Promise.all([agent.refreshAcpcLimits("sample"), agent.refreshAcpcLimits("sample")]);
  expect(reads).toBe(1);
  expect(messages).toEqual([{ sessionId: "sample", update: { sessionUpdate: "session_info_update", _meta: {
    "_claude/subscriptionLimits": { five_hour: five, seven_day: week }
  } } }]);
  session.nextAcpcLimitsRead = 0;
  response = { rate_limits_available: false, rate_limits: null };
  await agent.refreshAcpcLimits("sample");
  expect(messages[1].update._meta["_claude/subscriptionLimits"]).toBeNull();
});
