export const badgePulseKeyframes = `
@keyframes badge-pulse {
  0%, 100% {
    background-color: rgba(var(--team-rgb), 0.2);
    box-shadow: 0 0 12px rgba(var(--team-rgb), 0.55);
  }
  50% {
    background-color: rgba(var(--team-rgb), 0.38);
    box-shadow: 0 0 22px rgba(var(--team-rgb), 0.95);
  }
}
`;
