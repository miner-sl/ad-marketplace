export const playConfetti = async (confettiConfig?: any) => {
  const JSConfetti = (await import('js-confetti')).default;
  const confetti = new JSConfetti();
  
  confetti.addConfetti({
    ...(confettiConfig ?? {}),
    confettiNumber: "emojis" in (confettiConfig ?? {}) ? 40 : 200,
  });
};
