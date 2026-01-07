module.exports = (req, res) => {
  res.status(200).json({
    message: 'Hello from MonthlyMint API!',
    status: 'success',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  });
};
