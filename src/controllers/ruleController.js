import Rule from '../models/Rule.js';

export const createRule = async (req, res) => {
  try {
    const {
      name,
      platform,
      marketId,
      triggerType,
      condition,
      action
    } = req.body;

    if (condition.field === 'probability' && (condition.value < 0 || condition.value > 100)) {
      return res.status(400).json({
        message: 'Probability must be between 0 and 100'
      });
    }

    if (condition.field === 'price' && (condition.value < 0 || condition.value > 1)) {
      return res.status(400).json({
        message: 'Price must be between 0 and 1'
      });
    }

    const rule = new Rule({
      userId: req.userId,
      name,
      platform,
      marketId,
      triggerType,
      condition,
      action
    });

    await rule.save();

    await rule.populate('userId', 'username email');

    res.status(201).json({
      message: 'Rule created successfully',
      rule
    });
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({
      message: 'Error creating rule',
      error: error.message
    });
  }
};

export const getRules = async (req, res) => {
  try {
    const { platform, isActive } = req.query;
    
    const filter = { userId: req.userId };
    
    if (platform) {
      filter.platform = platform;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const rules = await Rule.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'username email');

    res.json({
      rules,
      count: rules.length
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({
      message: 'Error fetching rules',
      error: error.message
    });
  }
};

export const getRule = async (req, res) => {
  try {
    const rule = await Rule.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate('userId', 'username email');

    if (!rule) {
      return res.status(404).json({
        message: 'Rule not found'
      });
    }

    res.json({ rule });
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({
      message: 'Error fetching rule',
      error: error.message
    });
  }
};

export const updateRule = async (req, res) => {
  try {
    const { isActive, name, condition, action } = req.body;

    const rule = await Rule.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!rule) {
      return res.status(404).json({
        message: 'Rule not found'
      });
    }

    if (isActive !== undefined) rule.isActive = isActive;
    if (name) rule.name = name;
    if (condition) rule.condition = condition;
    if (action) rule.action = action;

    await rule.save();
    await rule.populate('userId', 'username email');

    res.json({
      message: 'Rule updated successfully',
      rule
    });
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({
      message: 'Error updating rule',
      error: error.message
    });
  }
};

export const deleteRule = async (req, res) => {
  try {
    const rule = await Rule.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!rule) {
      return res.status(404).json({
        message: 'Rule not found'
      });
    }

    res.json({
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({
      message: 'Error deleting rule',
      error: error.message
    });
  }
};

export const getRuleStats = async (req, res) => {
  try {
    const stats = await Rule.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: '$platform',
          total: { $sum: 1 },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalTriggers: { $sum: '$triggerCount' }
        }
      }
    ]);

    res.json({ stats });
  } catch (error) {
    console.error('Get rule stats error:', error);
    res.status(500).json({
      message: 'Error fetching rule statistics',
      error: error.message
    });
  }
};