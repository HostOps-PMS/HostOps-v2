export const sensor = {
  async respond(req, res, score, options = {}) {
    return new Promise((resolve) => {
      // Simulate delay to tarpit
      const delay = Math.floor(Math.random() * 1500) + 500;
      setTimeout(() => {
        if (options.alreadyBanned) {
          // Silent drop - close connection without returning a valid HTTP response
          if (res.socket) res.socket.destroy();
          else res.end();
          resolve();
        } else {
          // Fake fail mimicking real system's exact response
          res.status(401).json({ error: 'Invalid email or password' });
          resolve();
        }
      }, delay);
    });
  }
};
