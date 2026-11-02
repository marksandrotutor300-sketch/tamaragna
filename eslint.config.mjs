import next from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...next,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "data/generated/**",
      ".cache/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  {
    rules: {
      "@next/next/no-img-element": "off",
      // The battle stage is an imperative requestAnimationFrame loop that owns a
      // mutable simulation engine. Refs and time-based reads are deliberate there,
      // so the React Compiler's purity rules do not apply to it.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default eslintConfig;
