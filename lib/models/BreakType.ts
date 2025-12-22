import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBreakType extends Document {
  name: string;
  code: string; // 'lunch', 'tea', 'personal', 'custom'
  displayName: string;
  defaultDuration?: number; // in minutes
  isPaid: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BreakTypeSchema = new Schema<IBreakType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['lunch', 'tea', 'personal', 'custom', 'emergency'],
    },
    displayName: {
      type: String,
      required: true,
    },
    defaultDuration: {
      type: Number,
      default: null, // in minutes
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create default break types on first use
BreakTypeSchema.statics.ensureDefaults = async function () {
  const defaults = [
    { name: 'Lunch Break', code: 'lunch', displayName: 'Lunch', defaultDuration: 30, isPaid: true },
    { name: 'Tea/Coffee Break', code: 'tea', displayName: 'Tea/Coffee', defaultDuration: 15, isPaid: true },
    { name: 'Personal Break', code: 'personal', displayName: 'Personal', defaultDuration: 10, isPaid: false },
    { name: 'Emergency Break', code: 'emergency', displayName: 'Emergency', defaultDuration: null, isPaid: false },
    { name: 'Custom Break', code: 'custom', displayName: 'Custom', defaultDuration: null, isPaid: true },
  ];

  for (const defaultType of defaults) {
    await this.findOneAndUpdate(
      { code: defaultType.code },
      { $setOnInsert: defaultType },
      { upsert: true, new: true }
    );
  }
};

const BreakType: Model<IBreakType> =
  mongoose.models.BreakType || mongoose.model<IBreakType>('BreakType', BreakTypeSchema);

export default BreakType;

