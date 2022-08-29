import { Image } from "antd";
import React from "react";

// displays a page header

export default function Header() {
  return (
    <div style={{ textAlign: "left", marginLeft: 40, paddingTop: 20 }}>
      <a href="/">
        <Image preview={false} src="/images/logo.png" alt="Morra Game" title="Morra Game" />
      </a>
    </div>
  );
}
