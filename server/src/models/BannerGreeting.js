import mongoose from 'mongoose';

const bannerGreetingSchema = new mongoose.Schema(
  {
    template: {
      type: String,
      required: true,
      trim: true,
    },
    subtext: {
      type: String,
      default: "Great to see you again! Let's make today productive.",
      trim: true,
    },
    timeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'any'],
      default: 'any',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const DEFAULT_GREETINGS = [
  { template: 'Good morning, <name>', subtext: "Great to see you again! Let's make today productive.", timeOfDay: 'morning', order: 1 },
  { template: 'Good afternoon, <name>', subtext: "Hope your day is going smoothly! Let's keep the momentum.", timeOfDay: 'afternoon', order: 2 },
  { template: 'Good evening, <name>', subtext: 'Wrapping up today’s creative milestones. Great work!', timeOfDay: 'evening', order: 3 },
  { template: 'Hello, <name>', subtext: "Great to see you again! Let's make today productive.", timeOfDay: 'any', order: 4 },
  { template: 'Greetings and welcome! <name>', subtext: 'Welcome to your studio workspace today.', timeOfDay: 'any', order: 5 },
  { template: 'Welcome back, <name>!', subtext: 'Ready for another day of high-impact design and code.', timeOfDay: 'any', order: 6 },
];

export const BannerGreeting = mongoose.model('BannerGreeting', bannerGreetingSchema);
