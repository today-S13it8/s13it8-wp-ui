import { Button } from "@s13it8/wp-ui/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@s13it8/wp-ui/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@s13it8/wp-ui/ui/dialog"
import { Heart } from "lucide-react"
export default function Hello({ data }: { data: { name: string } }) {
  return <Card className="max-w-md"><CardHeader><CardTitle>Hello {data.name}</CardTitle></CardHeader>
    <CardContent><Dialog><DialogTrigger asChild><Button><Heart /> Open</Button></DialogTrigger>
    <DialogContent><DialogTitle>Inside</DialogTitle></DialogContent></Dialog></CardContent></Card>
}
