import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppLoadingScreen } from "./AppLoadingScreen";
import {
  SvgNThenBarsSplash,
  SvgPathAssemblySplash,
  SvgPathDrawSplash,
  SvgPathPulseSplash,
} from "./AppLoadingScreenConcepts";

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

export const SvgPathDraw: Story = {
  render: (args) => <SvgPathDrawSplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "light",
    },
  },
};

export const SvgNThenBars: Story = {
  render: (args) => <SvgNThenBarsSplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "light",
    },
  },
};

export const SvgPathAssembly: Story = {
  render: (args) => <SvgPathAssemblySplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "dark",
    },
  },
};

export const SvgPathPulse: Story = {
  render: (args) => <SvgPathPulseSplash label={args.label} />,
  parameters: {
    themes: {
      themeOverride: "light",
    },
  },
};
