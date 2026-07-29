import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppLoadingScreen } from "./AppLoadingScreen";

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
