import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Move dev indicator to bottom-right so it doesn't overlap the sidebar's
  // "Settings" link (which sits at bottom-left).
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
