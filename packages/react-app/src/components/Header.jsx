import { PageHeader } from "antd";
import React from "react";

// displays a page header

export default function Header() {
  return (
    <a href="/">
      <PageHeader
        title="🖐 Morra Game"
        subTitle="Each player show zero to five fingers and call out their guess at what the sum of all fingers shown will be. If one player guesses the sum, that player earns one point."
        style={{ cursor: "pointer" }}
      />
    </a>
  );
}
