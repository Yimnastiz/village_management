import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ระบบบริหารจัดการหมู่บ้านอัจฉริยะ",
  description: "Smart Village Management System - ระบบบริหารจัดการหมู่บ้านสำหรับชุมชนไทย",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  function stripAttr(root){
    if(!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[fdprocessedid]');
    for(var i=0;i<nodes.length;i++){ nodes[i].removeAttribute('fdprocessedid'); }
  }
  try {
    stripAttr(document);
    var observer = new MutationObserver(function(mutations){
      for(var i=0;i<mutations.length;i++){
        var m = mutations[i];
        if(m.type === 'attributes' && m.attributeName === 'fdprocessedid' && m.target){
          m.target.removeAttribute('fdprocessedid');
        }
        if(m.addedNodes && m.addedNodes.length){
          for(var j=0;j<m.addedNodes.length;j++){
            var n = m.addedNodes[j];
            if(n && n.nodeType === 1){
              if(n.hasAttribute && n.hasAttribute('fdprocessedid')) n.removeAttribute('fdprocessedid');
              stripAttr(n);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['fdprocessedid'] });
  } catch(_){}
})();`,
          }}
        />
      </head>
      <body
        className={`${notoSansThai.variable} font-sans antialiased bg-gray-50 text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
