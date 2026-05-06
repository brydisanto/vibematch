import DemoClient from "./DemoClient";

export const dynamic = "force-static";

export const metadata = {
    title: "Pin Drop — Demo Reel",
    description: "Standalone highlights reel for video capture.",
};

export default function DemoPage() {
    return <DemoClient />;
}
