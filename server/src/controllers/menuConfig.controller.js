import { MenuConfig, DEFAULT_ROLE_MENUS } from '../models/MenuConfig.js';
import { BannerGreeting, DEFAULT_GREETINGS } from '../models/BannerGreeting.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

export const toProperCase = (str) => {
  if (!str) return 'Team Member';
  const trimmed = str.trim();
  if (!trimmed) return 'Team Member';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

/**
 * Ensures defaults are seeded in MongoDB if collections are empty
 */
export const seedMenuAndGreetings = async () => {
  try {
    const menuCount = await MenuConfig.countDocuments();
    if (menuCount === 0) {
      await MenuConfig.insertMany(DEFAULT_ROLE_MENUS);
    }
    const greetingCount = await BannerGreeting.countDocuments();
    if (greetingCount === 0) {
      await BannerGreeting.insertMany(DEFAULT_GREETINGS);
    }
  } catch (err) {
    console.warn('Seeding menu/greetings notice:', err.message);
  }
};

/**
 * GET /api/v1/configurations/menu-access
 * Lists role menu mappings
 */
export const getRoleMenuConfigs = async (req, res, next) => {
  try {
    await seedMenuAndGreetings();
    const configs = await MenuConfig.find().lean();
    return sendSuccess(res, configs, 'Role menu configurations loaded');
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/configurations/menu-access/:roleKey
 * Updates menu mapping for a role
 */
export const updateRoleMenuConfig = async (req, res, next) => {
  try {
    const { roleKey } = req.params;
    const { allowedModuleKeys, allowedSubmenuKeys, topTabs, label } = req.body;

    const updated = await MenuConfig.findOneAndUpdate(
      { roleKey },
      {
        allowedModuleKeys,
        allowedSubmenuKeys,
        topTabs,
        label,
        updatedBy: req.user._id,
      },
      { upsert: true, new: true }
    );

    await logAudit({
      req,
      action: 'UPDATE_MENU_CONFIG',
      entity: 'MenuConfig',
      entityId: updated._id,
      changes: { roleKey, allowedModuleKeys, topTabs },
    });

    return sendSuccess(res, updated, `Menu access updated for role ${roleKey}`);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/configurations/menu-access/my-menu
 * Resolves current user's role-based menu & top tabs
 */
export const getMyMenuConfig = async (req, res, next) => {
  try {
    await seedMenuAndGreetings();
    const roleKey = req.user.role?.key || 'employee';
    let config = await MenuConfig.findOne({ roleKey }).lean();

    if (!config) {
      config = DEFAULT_ROLE_MENUS.find((m) => m.roleKey === roleKey) || DEFAULT_ROLE_MENUS[0];
    }

    return sendSuccess(res, config, 'My menu configuration resolved');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/configurations/greetings
 * Lists all banner greetings
 */
export const getGreetings = async (req, res, next) => {
  try {
    await seedMenuAndGreetings();
    const greetings = await BannerGreeting.find().sort({ order: 1 }).lean();
    return sendSuccess(res, greetings, 'Banner greetings loaded');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/configurations/greetings
 */
export const createGreeting = async (req, res, next) => {
  try {
    const { template, subtext, timeOfDay, isActive, order } = req.body;
    if (!template) {
      return sendError(res, 'Greeting template is required', 400);
    }
    const created = await BannerGreeting.create({
      template,
      subtext,
      timeOfDay,
      isActive,
      order,
    });
    return sendSuccess(res, created, 'Greeting template created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/configurations/greetings/:id
 */
export const updateGreeting = async (req, res, next) => {
  try {
    const updated = await BannerGreeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return sendError(res, 'Greeting not found', 404);
    return sendSuccess(res, updated, 'Greeting updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/configurations/greetings/:id
 */
export const deleteGreeting = async (req, res, next) => {
  try {
    await BannerGreeting.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Greeting deleted');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/home/greeting
 * Resolves personalized banner greeting for home screen
 */
export const getResolvedHomeGreeting = async (req, res, next) => {
  try {
    await seedMenuAndGreetings();

    // Determine time of day in IST
    const now = new Date();
    const istHour = parseInt(
      new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(now),
      10
    );

    let period = 'any';
    if (istHour >= 5 && istHour < 12) period = 'morning';
    else if (istHour >= 12 && istHour < 17) period = 'afternoon';
    else if (istHour >= 17 && istHour < 22) period = 'evening';

    // Find candidate greetings
    const candidates = await BannerGreeting.find({
      isActive: true,
      timeOfDay: { $in: [period, 'any'] },
    }).sort({ order: 1 });

    const rawFirstName =
      req.user?.employee?.personal?.firstName ||
      req.user?.email?.split('@')[0] ||
      'Team Member';
    const properFirstName = toProperCase(rawFirstName);

    let chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (!chosen) {
      chosen = {
        template: `Hello, <name>`,
        subtext: "Great to see you again! Let's make today productive.",
      };
    }

    const greetingText = chosen.template.replace(/<name>/gi, properFirstName);

    return sendSuccess(res, {
      greeting: greetingText,
      subtext: chosen.subtext,
      firstName: properFirstName,
      period,
    });
  } catch (err) {
    next(err);
  }
};
