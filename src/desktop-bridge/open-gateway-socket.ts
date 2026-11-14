/**
 * Upstream-aligned gateway WebSocket dial (canonical-protocol.ts).
 * - URL keeps native_dial, ticket removed from query
 * - protocols: hermes-gateway-v1 + hermes-gateway-ticket.<ticket>
 */

export const CANONICAL_GATEWAY_PROTOCOL = 'hermes-gateway-v1';

export function openGatewaySocket(wsUrl: string): WebSocket {
  const parsed = new URL(wsUrl);
  const ticket = parsed.searchParams.get('ticket');
  if (parsed.searchParams.has('native_dial') && ticket) {
    parsed.searchParams.delete('ticket');
    return new WebSocket(parsed.toString(), [
      CANONICAL_GATEWAY_PROTOCOL,
      `hermes-gateway-ticket.${ticket}`,
    ]);
  }
  return new WebSocket(wsUrl);
}
