import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppLoadingScreen } from "./AppLoadingScreen";
import { InnerSweepSplash, LivingBalanceSplash, StrokeAssemblySplash } from "./AppLoadingScreenConcepts";

const meta = {
  title: "Shared Components/App Loading Screen",
  component: AppLoadingScreen,
  args: {
    label: "Загрузка...",
  },
  decorators: [
    (Story) => (
      <div className="fixed inset-0 overflow-hidden">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AppLoadingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  parameters: {
    themes: {
      themeOverride: "light",
    },
  },
};

export const Dark: Story = {
  parameters: {
    themes: {
      themeOverride: "dark",
    },
  },
};

export const InnerSweep: Story = {
  render: (args) => <InnerSweepSplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "light",
    },
  },
};

export const StrokeAssembly: Story = {
  render: (args) => <StrokeAssemblySplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "dark",
    },
  },
};

export const LivingBalance: Story = {
  render: (args) => <LivingBalanceSplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "light",
    },
  },
};
