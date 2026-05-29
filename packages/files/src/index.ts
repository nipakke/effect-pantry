import { Files } from "files-sdk";
import { Context, Effect } from "effect"
import { fs } from "files-sdk/fs";
import { memory } from "files-sdk/memory";
import { Effectify } from "@effect/platform";



const make = () => {
  const files = new Files({
    adapter: memory({})
  })

  const upload = Effect.promise((signal) => files.upload("", {}, {
    signal
  }))


  const file = Effect.sync(() => {
    const f = files.file("")

    return {
      upload: () => Effect.promise(()=>f.upload(""))
    }
  })

}