import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { HealthResponseDto } from "./app.dto";

@Controller()
@ApiTags("Health")
export class AppController {
  @Get("health")
  @ApiOperation({ operationId: "getHealth", summary: "Read API health status" })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return { status: "ok" };
  }
}
