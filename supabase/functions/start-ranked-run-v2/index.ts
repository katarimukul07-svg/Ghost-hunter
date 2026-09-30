import {handleRanked} from '../_shared/ranked-handler.mjs';
import {rankedEnvironment} from '../_shared/ranked-environment.ts';
Deno.serve(request=>handleRanked(request,'start',rankedEnvironment()));
