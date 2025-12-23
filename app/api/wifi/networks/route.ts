import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import WiFiNetwork from '@/lib/models/WiFiNetwork';
import { z } from 'zod';

const createWiFiNetworkSchema = z.object({
  ssid: z.string().min(1, 'WiFi name is required'),
  bssid: z.string().optional(),
  location: z.string().optional(),
  officeAddress: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().min(0).default(0),
});

const updateWiFiNetworkSchema = createWiFiNetworkSchema.partial();

// GET - List all WiFi networks
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get('isActive');
    const location = searchParams.get('location');

    let query: any = {};

    if (isActive !== null) {
      query.isActive = isActive === 'true';
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const networks = await WiFiNetwork.find(query)
      .populate('createdBy', 'email')
      .sort({ priority: -1, createdAt: -1 })
      .limit(200);

    return NextResponse.json(networks);
  } catch (error) {
    console.error('Error fetching WiFi networks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new WiFi network
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createWiFiNetworkSchema.parse(body);

    await connectDB();

    // Normalize BSSID if provided
    if (validatedData.bssid) {
      validatedData.bssid = validatedData.bssid.trim().toUpperCase().replace(/[:-]/g, ':');
    }

    // Check for duplicate SSID+BSSID combination
    const duplicateQuery: any = {
      ssid: validatedData.ssid.trim(),
    };
    if (validatedData.bssid) {
      duplicateQuery.bssid = validatedData.bssid;
    } else {
      duplicateQuery.$or = [{ bssid: null }, { bssid: { $exists: false } }];
    }

    const existing = await WiFiNetwork.findOne(duplicateQuery);
    if (existing) {
      return NextResponse.json(
        { error: 'WiFi network with this SSID and BSSID already exists' },
        { status: 400 }
      );
    }

    const network = await WiFiNetwork.create({
      ...validatedData,
      ssid: validatedData.ssid.trim(),
      createdBy: session.user.id,
    });

    const populated = await WiFiNetwork.findById(network._id).populate('createdBy', 'email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating WiFi network:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update WiFi network
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Network ID is required' }, { status: 400 });
    }

    const validatedData = updateWiFiNetworkSchema.parse(updateData);

    await connectDB();

    const network = await WiFiNetwork.findById(id);
    if (!network) {
      return NextResponse.json({ error: 'WiFi network not found' }, { status: 404 });
    }

    // Normalize BSSID if provided
    if (validatedData.bssid) {
      validatedData.bssid = validatedData.bssid.trim().toUpperCase().replace(/[:-]/g, ':');
    }

    // Update network
    Object.assign(network, validatedData);
    if (validatedData.ssid) {
      network.ssid = validatedData.ssid.trim();
    }
    await network.save();

    const populated = await WiFiNetwork.findById(network._id).populate('createdBy', 'email');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating WiFi network:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete WiFi network
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Network ID is required' }, { status: 400 });
    }

    await connectDB();

    const network = await WiFiNetwork.findById(id);
    if (!network) {
      return NextResponse.json({ error: 'WiFi network not found' }, { status: 404 });
    }

    // Check if network is used in any active policies
    const WiFiPolicy = (await import('@/lib/models/WiFiPolicy')).default;
    const policiesUsingNetwork = await WiFiPolicy.find({
      allowedNetworks: id,
      isActive: true,
    });

    if (policiesUsingNetwork.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete network. It is used in active policies.',
          policies: policiesUsingNetwork.map((p) => ({ id: p._id, name: p.name })),
        },
        { status: 400 }
      );
    }

    await WiFiNetwork.findByIdAndDelete(id);

    return NextResponse.json({ message: 'WiFi network deleted successfully' });
  } catch (error) {
    console.error('Error deleting WiFi network:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

