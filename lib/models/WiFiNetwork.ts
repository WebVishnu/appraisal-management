import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWiFiNetwork extends Document {
  ssid: string; // Wi-Fi network name (Service Set Identifier)
  bssid?: string; // MAC address of access point (Basic Service Set Identifier) - optional for higher security
  location?: string; // Office/location name
  officeAddress?: string; // Physical address
  description?: string; // Additional notes
  isActive: boolean; // Whether this network is currently allowed
  priority: number; // Priority for matching (higher = more specific)
  createdBy: mongoose.Types.ObjectId; // User who created this network
  createdAt: Date;
  updatedAt: Date;
}

const WiFiNetworkSchema = new Schema<IWiFiNetwork>(
  {
    ssid: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    bssid: {
      type: String,
      trim: true,
      uppercase: true,
      match: /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i, // MAC address format validation
      sparse: true, // Allow multiple nulls
      index: true,
    },
    location: {
      type: String,
      trim: true,
      index: true,
    },
    officeAddress: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0, // Higher priority = more specific match
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
WiFiNetworkSchema.index({ ssid: 1, isActive: 1 });
WiFiNetworkSchema.index({ bssid: 1, isActive: 1 });
WiFiNetworkSchema.index({ ssid: 1, bssid: 1, isActive: 1 });

// Prevent duplicate SSID+BSSID combinations
WiFiNetworkSchema.index({ ssid: 1, bssid: 1 }, { unique: true, sparse: true });

const WiFiNetwork: Model<IWiFiNetwork> =
  mongoose.models.WiFiNetwork || mongoose.model<IWiFiNetwork>('WiFiNetwork', WiFiNetworkSchema);

export default WiFiNetwork;

