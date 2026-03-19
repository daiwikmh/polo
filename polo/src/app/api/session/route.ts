import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/session?address=0x...
// Fetch active session for a given EOA address
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address param" }, { status: 400 });
  }

  const session = await prisma.userSession.findUnique({
    where: { eoaAddress: address.toLowerCase() },
  });

  if (!session || !session.active) {
    return NextResponse.json({ session: null });
  }

  // Check expiry
  if (session.expiresAt < new Date()) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { active: false },
    });
    return NextResponse.json({ session: null, expired: true });
  }

  return NextResponse.json({
    session: {
      id: session.id,
      eoaAddress: session.eoaAddress,
      smartAccountAddress: session.smartAccountAddress,
      active: session.active,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}

// POST /api/session
// Create or update a session for a user
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eoaAddress, smartAccountAddress, sessionDetails, expiresAt } = body;

    if (!eoaAddress || !smartAccountAddress || !sessionDetails) {
      return NextResponse.json(
        { error: "Missing required fields: eoaAddress, smartAccountAddress, sessionDetails" },
        { status: 400 },
      );
    }

    const session = await prisma.userSession.upsert({
      where: { eoaAddress: eoaAddress.toLowerCase() },
      update: {
        smartAccountAddress,
        sessionDetails,
        active: true,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      create: {
        eoaAddress: eoaAddress.toLowerCase(),
        smartAccountAddress,
        sessionDetails,
        active: true,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        eoaAddress: session.eoaAddress,
        smartAccountAddress: session.smartAccountAddress,
        active: session.active,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/session
// Revoke a session
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { eoaAddress } = body;

    if (!eoaAddress) {
      return NextResponse.json({ error: "Missing eoaAddress" }, { status: 400 });
    }

    await prisma.userSession.updateMany({
      where: { eoaAddress: eoaAddress.toLowerCase() },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
