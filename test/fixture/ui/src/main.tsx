import "./styles.css"
import { startViews } from "@s13it8/wp-ui/boot"
startViews({ scope: "demo-app", label: "Demo", views: { hello: () => import("./views/hello") } })
